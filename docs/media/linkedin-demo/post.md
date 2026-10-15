Who loaded the dishwasher like this?

Everyone has an opinion, so we built a game to score it. DishwasherBench is an open-source dishwasher-loading game on a physics simulation of one real machine: photographed, measured and test-washed with egg yolk. Clone it and play in your browser, or plug in an AI agent: it plays through 13 MCP tools. Load it, a simulated Eco 50 wash runs, and only the items that come out clean score.

In a quick simulated wash, the same 7 tutorial dishes scored 14 of the 44 points they are worth loaded badly (mug and bowl mouth up, glass on its side) and 34 loaded well: all 20 points came from turning the mug, bowl and glass the right way up. The mouth-up mug held 319 ml of water and came out dirty; the same mug mouth down came out clean.

Then we let two AI models play: six games, and no mug or bowl went in mouth up. One took out the cutlery basket to fit a frying pan, couldn't get the basket back in, and took the pan out again. Relatable. On the biggest level, both beat our scripted "careful" player. (Azure deployments gpt-6.1-sol and gpt-6-astra, at medium reasoning effort.)

No human baseline yet. Fancy being the first?

https://github.com/composo-ai/DishwasherBench

#AIEvaluation #AIAgents #OpenSource
