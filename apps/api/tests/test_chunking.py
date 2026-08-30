"""Unit tests for task-specific document chunking and aggregation."""

from omnitext.ml.chunking.chunker import (
    aggregate_classification,
    aggregate_keywords,
    aggregate_ner,
    aggregate_sentiment,
    split_text_with_offsets,
)


def test_split_text_with_offsets() -> None:
    """Test text splitting logic and character offsets."""
    text = "word1 word2 word3 word4 word5"
    
    # 1. No split needed
    chunks = split_text_with_offsets(text, max_words=10, overlap=2)
    assert len(chunks) == 1
    assert chunks[0] == (text, 0)

    # 2. Split with overlap
    # words: ["word1", "word2", "word3", "word4", "word5"]
    chunks = split_text_with_offsets(text, max_words=3, overlap=1)
    assert len(chunks) == 2
    # First chunk: word1 word2 word3
    assert chunks[0][0] == "word1 word2 word3"
    assert chunks[0][1] == 0
    # Second chunk: word3 word4 word5 (overlap 1 word)
    assert chunks[1][0] == "word3 word4 word5"
    assert chunks[1][1] == text.find("word3")


def test_aggregate_sentiment() -> None:
    """Test sentiment polarity score averaging across chunks."""
    predictions = [
        {"label": "POSITIVE", "score": 0.8},
        {"label": "POSITIVE", "score": 0.6},
        {"label": "NEGATIVE", "score": 0.2},
    ]
    aggregated = aggregate_sentiment(predictions)
    # total: +0.8 + 0.6 - 0.2 = +1.2. avg: 1.2 / 3 = 0.4 POSITIVE
    assert aggregated["label"] == "POSITIVE"
    assert aggregated["score"] == 0.4


def test_aggregate_ner() -> None:
    """Test duplicate NER entity boundary deduplication."""
    entities_list = [
        [
            {"entity": "Google", "label": "ORG", "start": 0, "end": 6, "confidence": 0.95},
        ],
        [
            {"entity": "Google", "label": "ORG", "start": 0, "end": 6, "confidence": 0.98},
            {"entity": "California", "label": "LOC", "start": 10, "end": 20, "confidence": 0.9},
        ]
    ]
    aggregated = aggregate_ner(entities_list)
    assert len(aggregated) == 2
    # Deduplication kept the higher confidence one for Google (0.98)
    assert aggregated[0]["entity"] == "Google"
    assert aggregated[0]["confidence"] == 0.98
    assert aggregated[1]["entity"] == "California"


def test_aggregate_classification() -> None:
    """Test classification scores averaging."""
    predictions_list = [
        [{"label": "sports", "score": 0.8}, {"label": "politics", "score": 0.2}],
        [{"label": "sports", "score": 0.6}, {"label": "politics", "score": 0.4}],
    ]
    aggregated = aggregate_classification(predictions_list)
    assert aggregated[0]["label"] == "sports"
    assert aggregated[0]["score"] == 0.7  # (0.8 + 0.6) / 2
    assert aggregated[1]["label"] == "politics"
    assert aggregated[1]["score"] == 0.3


def test_aggregate_keywords() -> None:
    """Test keyword ranking and merging."""
    keywords_list = [
        [{"keyword": "nlp", "score": 0.9}, {"keyword": "ai", "score": 0.6}],
        [{"keyword": "nlp", "score": 0.7}, {"keyword": "code", "score": 0.5}],
    ]
    aggregated = aggregate_keywords(keywords_list, top_n=2)
    assert len(aggregated) == 2
    assert aggregated[0]["keyword"] == "nlp"
    assert aggregated[0]["score"] == 0.8  # (0.9 + 0.7) / 2
