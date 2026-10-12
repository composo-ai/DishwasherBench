"""Solves the pinhole camera of photo-overlay.ts from hand-picked points, by least squares.

    python3 photo_fit_camera.py <points.json> <camera-out.json>

points.json:

    { "initial": { camera as in photo-overlay.ts },
      "free": ["x", "y", "z", "yaw", "pitch", "roll", "focal"],     which parameters to solve
      "priors": { "focal": [4200, 100], "yaw": [0, 5] },            optional [value, sigma]
      "points": [ { "name": "...", "px": [u, v], "mm": [x, y, z],   basket frame, mm
                    "sigmaPx": 6, "use": "uv" } ] }                 "u" or "v" for one coordinate

A point whose position in the model is only known along one image direction (a point somewhere
along a level rail, say) is given with "use": "v" (or "u"). The camera convention is that of
photo-overlay.ts: at zero angles it looks along +y, image x is +x and image y is -z; yaw turns the
view towards +x, pitch up, roll turns the picture clockwise. Levenberg-Marquardt with a numerical
Jacobian (numpy only). Prints the residual of every point in pixels and in millimetres at the
point's depth, and the formal one-sigma uncertainty of each free parameter (from the residual
variance), and writes the camera with a "fit" block holding the same figures.
"""

import json
import math
import sys

import numpy as np

NAMES = ["x", "y", "z", "yaw", "pitch", "roll", "focal", "cx", "cy"]


def to_vector(cam):
    return np.array(list(cam["positionMm"]) + [cam["yawDeg"], cam["pitchDeg"], cam["rollDeg"],
                                               cam["focalPx"]] + list(cam["principalPx"]), float)


def to_camera(p):
    return {"positionMm": [float(v) for v in p[0:3]], "yawDeg": float(p[3]),
            "pitchDeg": float(p[4]), "rollDeg": float(p[5]), "focalPx": float(p[6]),
            "principalPx": [float(p[7]), float(p[8])]}


def axes(p):
    yaw, pitch, roll = [math.radians(v) for v in p[3:6]]
    cy, sy, cp, sp, cr, sr = (math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch),
                              math.cos(roll), math.sin(roll))
    fwd = np.array([sy * cp, cy * cp, sp])
    right0 = np.array([cy, -sy, 0.0])
    down0 = np.array([sy * sp, cy * sp, -cp])
    return cr * right0 + sr * down0, cr * down0 - sr * right0, fwd


def project(p, xyz):
    """Pixels and depths (mm along the optical axis) of an (n, 3) array of basket-frame points."""
    right, down, fwd = axes(p)
    d = np.asarray(xyz, float) - p[0:3]
    depth = d @ fwd
    return np.stack([p[7] + p[6] * (d @ right) / depth, p[8] + p[6] * (d @ down) / depth], 1), depth


def main():
    spec = json.load(open(sys.argv[1]))
    p0 = to_vector(spec["initial"])
    free = [NAMES.index(n) for n in spec["free"]]
    pts = [q for q in spec["points"] if not q.get("skip")]
    xyz = np.array([q["mm"] for q in pts], float)
    obs = np.array([q["px"] for q in pts], float)
    sig = np.array([q.get("sigmaPx", 6.0) for q in pts], float)
    use_u = np.array(["u" in q.get("use", "uv") for q in pts])
    use_v = np.array(["v" in q.get("use", "uv") for q in pts])
    priors = [(NAMES.index(k), v[0], v[1]) for k, v in spec.get("priors", {}).items()]

    def residuals(p):
        uv, _ = project(p, xyz)
        r = (uv - obs) / sig[:, None]
        out = list(r[use_u, 0]) + list(r[use_v, 1])
        out += [(p[i] - value) / sigma for i, value, sigma in priors]
        return np.array(out)

    def jacobian(p):
        cols = []
        for i in free:
            h = 1e-4 * max(1.0, abs(p[i]))
            a, b = p.copy(), p.copy()
            a[i] += h
            b[i] -= h
            cols.append((residuals(a) - residuals(b)) / (2 * h))
        return np.stack(cols, 1)

    p = p0.copy()
    lam = 1e-3
    cost = float(residuals(p) @ residuals(p))
    for _ in range(200):
        r, J = residuals(p), jacobian(p)
        A, g = J.T @ J, J.T @ r
        step = np.linalg.solve(A + lam * np.diag(np.diag(A) + 1e-12), -g)
        q = p.copy()
        q[free] += step
        new = float(residuals(q) @ residuals(q))
        if new < cost:
            converged = cost - new < 1e-10 * max(1.0, cost)
            p, cost, lam = q, new, lam / 3
            if converged:
                break
        else:
            lam *= 5
            if lam > 1e12:
                break

    uv, depth = project(p, xyz)
    r, J = residuals(p), jacobian(p)
    dof = max(1, len(r) - len(free))
    cov = np.linalg.inv(J.T @ J) * max(1.0, cost / dof)
    report = []
    print(f"{'point':34s} {'du px':>8s} {'dv px':>8s} {'depth':>7s} {'du mm':>7s} {'dv mm':>7s}")
    for k, q in enumerate(pts):
        du, dv = uv[k] - obs[k]
        mm = depth[k] / p[6]
        used = q.get("use", "uv")
        print(f"{q['name']:34s} {du:8.1f} {dv:8.1f} {depth[k]:7.0f} {du * mm:7.2f} {dv * mm:7.2f}  [{used}]")
        report.append({"name": q["name"], "use": used, "duPx": round(float(du), 2),
                       "dvPx": round(float(dv), 2), "depthMm": round(float(depth[k]), 1)})
    used_r = np.concatenate([(uv - obs)[use_u, 0], (uv - obs)[use_v, 1]])
    rms = float(np.sqrt(np.mean(used_r ** 2)))
    print(f"rms of the used coordinates: {rms:.1f} px over {len(used_r)} coordinates, "
          f"{len(free)} free parameters, chi2/dof {cost / dof:.2f}")
    sigma = {}
    for j, i in enumerate(free):
        sigma[NAMES[i]] = float(np.sqrt(cov[j, j]))
        print(f"  {NAMES[i]:6s} {p[i]:10.3f} +- {sigma[NAMES[i]]:.3f}")
    cam = to_camera(p)
    cam["fit"] = {"rmsPx": round(rms, 2), "coordinates": int(len(used_r)), "free": spec["free"],
                  "sigma": {k: round(v, 3) for k, v in sigma.items()}, "residuals": report}
    json.dump(cam, open(sys.argv[2], "w"), indent=1)


if __name__ == "__main__":
    main()
