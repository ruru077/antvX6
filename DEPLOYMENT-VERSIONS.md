# M2PLink deployment versions

The `hs` branch retains the platform integration: session identity, cloud model files,
bundled block catalog and `/m2plab/matlab/websocketsimulatert` by default.
`VITE_M2PLINK_API_BASE` and `VITE_M2PLINK_SIMULATION_WS` are optional deployment overrides.
Leaving them unset preserves the existing `hs` behavior.

The standalone application deployed on port 4173 on 2026-09-16 corresponds to commit
`c74166d03a305252368714ffee287063a2b3c271`, which is included in the history of `hs`.
It uses `/playground` and retains its upstream standalone behavior; it is not the
platform-integrated application at the tip of `hs`.

To reproduce the standalone source without changing a working checkout:

```sh
git fetch origin hs
git worktree add --detach ../m2plink-standalone-20260916 c74166d03a305252368714ffee287063a2b3c271
```

Install the lockfile-pinned dependencies there, retain the existing production environment
settings, and build with the values in `.env.m2plab.example` exported in the environment:

```sh
VITE_M2PLINK_API_BASE=/m2plab/m2plink-service \
VITE_M2PLINK_SIMULATION_WS=/m2plab/m2plink-service/websocketsimulatert \
./node_modules/.bin/vp build --mode production
```

The proxy prefix is provided by the M2PLab deployment gateway. The `master` branch
was not changed by this synchronization. Runtime configuration, verification and
rollback details live in `lab-liu/m2plab-deploy/releases/sim-repair-20260916/`.
