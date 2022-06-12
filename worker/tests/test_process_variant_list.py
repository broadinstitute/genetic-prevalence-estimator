# pylint: disable=no-self-use
import base64
import json

import pytest
from rest_framework.test import APIClient

from calculator.models import VariantList


TEST_CASES = [
    # Recommended, gnomAD v2
    {
        "label": "Recommended gnomAD v2 with ClinVar pathogenic or likely pathogenic",
        "type": VariantList.Type.RECOMMENDED,
        "metadata": {
            "version": "1",
            "reference_genome": "GRCh37",
            "gnomad_version": "2.1.1",
            "gene_id": "ENSG00000169174.9",
            "transcript_id": "ENST00000302118.5",
            "included_clinvar_variants": ["pathogenic_or_likely_pathogenic"],
        },
    },
    {
        "label": "Recommended gnomAD v2 with ClinVar pathogenic or likely pathogenic and conflicting interpretations",
        "type": VariantList.Type.RECOMMENDED,
        "metadata": {
            "version": "1",
            "reference_genome": "GRCh37",
            "gnomad_version": "2.1.1",
            "gene_id": "ENSG00000169174.9",
            "transcript_id": "ENST00000302118.5",
            "included_clinvar_variants": [
                "pathogenic_or_likely_pathogenic",
                "conflicting_interpretations",
            ],
        },
    },
    {
        "label": "Recommended gnomAD v2 without ClinVar",
        "type": VariantList.Type.RECOMMENDED,
        "metadata": {
            "version": "1",
            "reference_genome": "GRCh37",
            "gnomad_version": "2.1.1",
            "gene_id": "ENSG00000169174.9",
            "transcript_id": "ENST00000302118.5",
            "included_clinvar_variants": [],
        },
    },
    # Recommended, gnomAD v3
    {
        "label": "Recommended gnomAD v3 with ClinVar pathogenic or likely pathogenic",
        "type": VariantList.Type.RECOMMENDED,
        "metadata": {
            "version": "1",
            "reference_genome": "GRCh38",
            "gnomad_version": "3.1.2",
            "gene_id": "ENSG00000169174.11",
            "transcript_id": "ENST00000302118.5",
            "included_clinvar_variants": ["pathogenic_or_likely_pathogenic"],
        },
    },
    {
        "label": "Recommended gnomAD v3 with ClinVar pathogenic or likely pathogenic and conflicting interpretations",
        "type": VariantList.Type.RECOMMENDED,
        "metadata": {
            "version": "1",
            "reference_genome": "GRCh38",
            "gnomad_version": "3.1.2",
            "gene_id": "ENSG00000169174.11",
            "transcript_id": "ENST00000302118.5",
            "included_clinvar_variants": [
                "pathogenic_or_likely_pathogenic",
                "conflicting_interpretations",
            ],
        },
    },
    {
        "label": "Recommended gnomAD v3 without ClinVar",
        "type": VariantList.Type.RECOMMENDED,
        "metadata": {
            "version": "1",
            "reference_genome": "GRCh38",
            "gnomad_version": "3.1.2",
            "gene_id": "ENSG00000169174.11",
            "transcript_id": "ENST00000302118.5",
            "included_clinvar_variants": [],
        },
    },
    # Custom, gnomAD v2
    {
        "label": "Custom gnomAD v2",
        "type": VariantList.Type.CUSTOM,
        "metadata": {
            "version": "1",
            "reference_genome": "GRCh37",
            "gnomad_version": "2.1.1",
        },
        "variants": [
            {"id": "1-55512222-C-G"},
            {"id": "1-55512222-C-A"},
        ],
    },
    # Custom, gnomAD v3
    {
        "label": "Recommended gnomAD v3",
        "type": VariantList.Type.RECOMMENDED,
        "metadata": {
            "version": "1",
            "reference_genome": "GRCh38",
            "gnomad_version": "3.1.2",
        },
        "variants": [
            {"id": "1-55046549-C-G"},
            {"id": "1-55046549-C-A"},
        ],
    },
]


@pytest.mark.django_db
class TestProcessVariantList:
    def _request_process_variant_list(self, variant_list):
        client = APIClient()

        payload = {"type": "new_variant_list", "args": {"uuid": str(variant_list.uuid)}}

        response = client.post(
            "/",
            {
                "message": {
                    "data": base64.b64encode(json.dumps(payload).encode("utf-8"))
                }
            },
        )

        assert response.status_code == 204

    @pytest.mark.parametrize(
        "variant_list_args", TEST_CASES, ids=[args["label"] for args in TEST_CASES]
    )
    def test_process_variant_list(self, variant_list_args):
        variant_list = VariantList.objects.create(**variant_list_args)
        self._request_process_variant_list(variant_list)
        variant_list.refresh_from_db()
        assert variant_list.variants
