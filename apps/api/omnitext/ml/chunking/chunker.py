"""Task-specific document chunking and aggregation module."""

import re
from typing import Any, cast


def split_text_with_offsets(text: str, max_words: int = 400, overlap: int = 50) -> list[tuple[str, int]]:
    """Split text into word-based chunks and return their original character start offsets."""
    word_spans = [m.span() for m in re.finditer(r"\S+", text)]
    if not word_spans:
        return [(text, 0)]

    chunks = []
    i = 0
    while i < len(word_spans):
        end_i = min(i + max_words, len(word_spans))
        start_char = word_spans[i][0]
        end_char = word_spans[end_i - 1][1]
        chunk_text = text[start_char:end_char]
        chunks.append((chunk_text, start_char))

        if end_i == len(word_spans):
            break
        i += (max_words - overlap)
        if i >= len(word_spans):
            break

    return chunks


def aggregate_summaries(summaries: list[str]) -> str:
    """Combine summaries of distinct text chunks."""
    # Joining summaries with a space
    return " ".join(summaries)


def aggregate_sentiment(predictions: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate sentiment predictions across chunks by averaging polarity score."""
    if not predictions:
        return {"label": "POSITIVE", "score": 0.0}

    total_score = 0.0
    for pred in predictions:
        score = pred["score"]
        label = pred["label"].upper()
        if "NEG" in label:
            total_score -= score
        else:
            total_score += score

    avg_score = total_score / len(predictions)
    aggregated_label = "POSITIVE" if avg_score >= 0 else "NEGATIVE"
    return {
        "label": aggregated_label,
        "score": round(abs(avg_score), 4),
    }


def aggregate_classification(predictions_list: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """Aggregate zero-shot classification scores by averaging scores across chunks."""
    if not predictions_list:
        return []

    label_scores: dict[str, list[float]] = {}
    for predictions in predictions_list:
        for pred in predictions:
            label = pred["label"]
            score = pred["score"]
            label_scores.setdefault(label, []).append(score)

    aggregated = []
    for label, scores in label_scores.items():
        avg_score = sum(scores) / len(scores)
        aggregated.append({"label": label, "score": round(avg_score, 4)})

    # Sort descending by score
    aggregated.sort(key=lambda x: cast(float, x["score"]), reverse=True)
    return aggregated


def aggregate_ner(entities_list: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """Deduplicate NER entities overlapping at chunk boundaries.

    Keeps the entity with higher confidence in case of duplicate offsets.
    """
    merged: dict[tuple[int, int, str], dict[str, Any]] = {}
    for entities in entities_list:
        for ent in entities:
            key = (ent["start"], ent["end"], ent["label"])
            if key not in merged:
                merged[key] = ent
            else:
                # Keep entity with higher confidence
                if ent["confidence"] > merged[key]["confidence"]:
                    merged[key] = ent

    # Return entities sorted by start index
    result = list(merged.values())
    result.sort(key=lambda x: cast(int, x["start"]))
    return result


def aggregate_keywords(keywords_list: list[list[dict[str, Any]]], top_n: int = 8) -> list[dict[str, Any]]:
    """Merge keywords extracted across chunks and re-rank."""
    keyword_scores: dict[str, list[float]] = {}
    for keywords in keywords_list:
        for kw in keywords:
            word = kw["keyword"]
            score = kw["score"]
            keyword_scores.setdefault(word, []).append(score)

    merged = []
    for word, scores in keyword_scores.items():
        avg_score = sum(scores) / len(scores)
        merged.append({"keyword": word, "score": round(avg_score, 4)})

    merged.sort(key=lambda x: cast(float, x["score"]), reverse=True)
    return merged[:top_n]
