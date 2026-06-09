# GenIE, the Genetic Prevalence and Incidence Estimator

<div align="left">

![Frontend CI status badge](https://github.com/broadinstitute/genetic-prevalence-estimator/actions/workflows/frontend-ci.yml/badge.svg)
![Backend CI status badge](https://github.com/broadinstitute/genetic-prevalence-estimator/actions/workflows/website-ci.yml/badge.svg)
![Pipeline CI status badge](https://github.com/broadinstitute/genetic-prevalence-estimator/actions/workflows/pipeline-ci.yml/badge.svg)

</div>

GenIE, the Genetic Prevalence and Incidence Estimator, uses gnomAD allele frequencies to estimate the genetic prevalence of autosomal recessive diseases, and gnomAD constraint data to estimate genetic incidence of autosomal dominant diseases. This tool was developed in partnership with the [Chan Zuckerberg Initiative Rare as One Network](https://chanzuckerberg.com/science/programs-resources/rare-as-one/). By removing the need for computational expertise, GenIE makes estimating the genetic prevalence of rare recessive disease more accessible to the entire genomics community.

GenIE:

- Simplifies creating genetic prevalence estimates by automating the process of compiling disease-causing variants (from [ClinVar](https://www.ncbi.nlm.nih.gov/clinvar/)) with allele frequency and constraint data (from [gnomAD](https://gnomad.broadinstitute.org/))
- Offers [multiple standardized methods](https://genie.broadinstitute.org/faq/#what-method-does-genie-use-to-calculate-carrier-frequency-and-genetic-prevalence) for calculating carrier frequency and genetic prevalence
- Improves transparency by clearly displaying data sources, methods used, variant details, and allele frequencies used for the estimates
- Allows users to share these genetic prevalence estimates either privately with other GenIE users or publicly through the [GenIE dashboard](https://genie.broadinstitute.org/dashboard/).

## Website

https://genie.broadinstitute.org/

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md).
