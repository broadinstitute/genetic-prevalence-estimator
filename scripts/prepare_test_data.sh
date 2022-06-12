#!/bin/bash

set -euo pipefail

print_usage() {
  echo "Usage: prepare_test_data.sh [DATASET ...]" 1>&2
}

import_gnomad=false
import_clinvar=false

if [ $# = 0 ]; then
  import_gnomad=true
  import_clinvar=true
else
  while [ $# -ne 0 ]; do
    dataset=$(echo "$1" | tr "[:upper:]" "[:lower:]")

    if [ "$dataset" = "gnomad" ]; then
      import_gnomad=true
      shift
      continue
    fi

    if [ "$dataset" = "clinvar" ]; then
      import_clinvar=true
      shift
      continue
    fi

    echo "Unknown dataset $dataset" 1>&2
    exit 1
  done
fi

# cd to project directory
cd "$(dirname "$0")"/..

mkdir -p data

# Intervals for PCSK9
GRCH38_INTERVALS="chr1:55039447-55064852"
GRCH37_INTERVALS="1:55505221-55530525"

if [ $import_gnomad = "true" ]; then
  python data-pipelines/prepare_gnomad_variants.py \
    --gnomad-version=3 \
    --intervals=$GRCH38_INTERVALS \
    --partitions=2 \
    ./data/gnomAD_v3.1.2_variants.ht

  python data-pipelines/prepare_gnomad_variants.py \
    --gnomad-version=2 \
    --intervals=$GRCH37_INTERVALS \
    --partitions=2 \
    ./data/gnomAD_v2.1.1_variants.ht
fi

if [ $import_clinvar = "true" ]; then
  python ./data-pipelines/import_clinvar.py \
    --reference-genome=GRCh38 \
    --intervals=$GRCH38_INTERVALS \
    --partitions=2 \
    ./data/ClinVar_GRCh38_variants.ht

  python ./data-pipelines/import_clinvar.py \
    --reference-genome=GRCh37 \
    --intervals=$GRCH37_INTERVALS \
    --partitions=2 \
    ./data/ClinVar_GRCh37_variants.ht
fi
