# Models

`celsus.glb` is the photogrammetry scan of the Library of Celsus, shown by the "See it today" button in Ephesus.
Add a scan for another site the same way: optimise it (`tools/optimize.sh`), put it here and set `model`, `fit` and
`offset` in that site's file under `src/sites/`. Raw downloads go in `models/raw/` (ignored by git).
