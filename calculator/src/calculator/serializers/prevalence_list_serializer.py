import re

from rest_framework import serializers
from calculator.models import PrevalenceList
from calculator.models import VariantList
from calculator.serializers.serializer import ModelSerializer


class NewPrevalenceListSerializer(ModelSerializer):

    
class PrevalenceListSerializer(ModelSerializer):
    prevalence_orph = serializers.CharField()
    prevalence_orph_link = serializers.CharField()
    prevalence_genereviews = serializers.CharField()
    prevalence_genereviews_link = serializers.CharField()
    prevalence_other = serializers.CharField()
    incidence_other = serializers.CharField()