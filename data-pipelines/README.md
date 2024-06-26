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
