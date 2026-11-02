# Data pipelines

Pipelines in this directory pre-compute data used by the calculator application.

All pipelines should be run and output written to the application data bucket.

```
hailctl dataproc submit $CLUSTER ./import_clinvar.py --reference-genome GRCh37 $BUCKET/ClinVar_GRCh37_variants.ht
hailctl dataproc submit $CLUSTER ./import_clinvar.py --reference-genome GRCh38 $BUCKET/ClinVar_GRCh38_variants.ht

hailctl dataproc submit $CLUSTER ./prepare_gnomad_variants.py --gnomad-version 2 $BUCKET/gnomAD_v2.1.1_variants.ht
hailctl dataproc submit $CLUSTER ./prepare_gnomad_variants.py --gnomad-version 4 $BUCKET/gnomAD_v4.1.0_variants.ht

hailctl dataproc submit $CLUSTER ./import_lof_curation_results.py --gnomad-version 2 $BUCKET/gnomAD_v2.1.1_lof_curation_results.ht
```

## Golden snapshots

`tests/snapshots/golden/` holds the recessive dashboard pipeline's output for the genes in
`tests/snapshots/golden_fixture_genes.csv`, one JSON file per gene.
Running the check needs `../data/processed_data/` and access to the gnomAD GCS bucket.

```
uv run python data-pipelines/tests/snapshots/golden_snapshots.py                  # check all
uv run python data-pipelines/tests/snapshots/golden_snapshots.py --fast           # check SAMD11 only
uv run python data-pipelines/tests/snapshots/golden_snapshots.py --symbols SOX4   # check a subset
uv run python data-pipelines/tests/snapshots/golden_snapshots.py --update         # rewrite all
uv run python data-pipelines/tests/snapshots/golden_snapshots.py --update --symbols SOX4
```

`--gnomad-variants-path PATH` reads gnomAD from a local table instead of GCS; it must
contain every gene in the run.

Each chromosome in the run costs about a minute; the full set covers 4. Run
`--update` only for an intended output change, and commit the golden diff with it.
