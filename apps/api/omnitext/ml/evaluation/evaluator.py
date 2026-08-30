"""Task-specific NLP evaluation metrics.

Calculates metrics (ROUGE-L, seqeval F1, Accuracy, Exact Match, and Recall@K)
using self-contained Python logic to avoid package-dependency overhead.
"""

import string
from typing import Any


def calculate_lcs(x: list[str], y: list[str]) -> int:
    """Compute the length of the Longest Common Subsequence of two string lists."""
    m = len(x)
    n = len(y)
    if m == 0 or n == 0:
        return 0

    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if x[i - 1] == y[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[m][n]


def calculate_rouge_l(prediction: str, reference: str) -> float:
    """Calculate ROUGE-L F1 score based on LCS overlap of tokenized words."""
    # Simple whitespace tokenization & punctuation stripping
    trans = str.maketrans("", "", string.punctuation)
    pred_tokens = prediction.lower().translate(trans).split()
    ref_tokens = reference.lower().translate(trans).split()

    if not pred_tokens or not ref_tokens:
        return 0.0

    lcs_len = calculate_lcs(pred_tokens, ref_tokens)
    recall = lcs_len / len(ref_tokens)
    precision = lcs_len / len(pred_tokens)

    if recall + precision == 0:
        return 0.0
    return (2.0 * recall * precision) / (recall + precision)


def calculate_accuracy(predictions: list[str], references: list[str]) -> float:
    """Calculate basic classification label Accuracy."""
    if not predictions or len(predictions) != len(references):
        return 0.0
    correct = sum(1 for p, r in zip(predictions, references) if p.lower().strip() == r.lower().strip())
    return correct / len(predictions)


def normalize_qa_text(text: str) -> str:
    """Normalize text for exact match QA evaluation by stripping articles, punctuation, and whitespace."""
    text = text.lower()
    # Strip punctuation
    text = text.translate(str.maketrans("", "", string.punctuation))
    # Strip articles
    articles = {"a", "an", "the"}
    tokens = [t for t in text.split() if t not in articles]
    return " ".join(tokens).strip()


def calculate_exact_match(prediction: str, reference: str) -> float:
    """Calculate Exact Match (EM) binary score (1.0 or 0.0) for QA."""
    return 1.0 if normalize_qa_text(prediction) == normalize_qa_text(reference) else 0.0


def calculate_ner_f1(predicted_entities: list[dict[str, Any]], ground_truth_entities: list[dict[str, Any]]) -> float:
    """Calculate entity-level F1 score for Named Entity Recognition.

    Expects list of dicts with keys: 'start', 'end', 'entity_group' (or 'type').
    """
    if not predicted_entities and not ground_truth_entities:
        return 1.0

    # Represent entities as tuples: (start, end, label)
    def to_tuples(entities: list[dict[str, Any]]) -> set[tuple[int, int, str]]:
        res = set()
        for ent in entities:
            start = ent.get("start", 0)
            end = ent.get("end", 0)
            label = str(ent.get("entity_group", ent.get("entity", ent.get("type", "UNK")))).upper()
            res.add((start, end, label))
        return res

    pred_set = to_tuples(predicted_entities)
    gt_set = to_tuples(ground_truth_entities)

    true_positives = len(pred_set.intersection(gt_set))
    if true_positives == 0:
        return 0.0

    precision = true_positives / len(pred_set)
    recall = true_positives / len(gt_set)

    return (2.0 * precision * recall) / (precision + recall)


def calculate_keyword_f1(predicted_keywords: list[str], ground_truth_keywords: list[str]) -> float:
    """Calculate overlap F1 score between predicted keywords and ground truth."""
    if not predicted_keywords and not ground_truth_keywords:
        return 1.0

    pred_set = {kw.lower().strip() for kw in predicted_keywords}
    gt_set = {kw.lower().strip() for kw in ground_truth_keywords}

    true_positives = len(pred_set.intersection(gt_set))
    if true_positives == 0:
        return 0.0

    precision = true_positives / len(pred_set)
    recall = true_positives / len(gt_set)

    return (2.0 * precision * recall) / (precision + recall)


def calculate_search_recall(predicted_files: list[str], ground_truth_files: list[str]) -> float:
    """Calculate retrieval Recall (how many relevant files are retrieved)."""
    if not ground_truth_files:
        return 1.0
    if not predicted_files:
        return 0.0

    pred_set = {f.lower().strip() for f in predicted_files}
    gt_set = {f.lower().strip() for f in ground_truth_files}

    hits = len(pred_set.intersection(gt_set))
    return hits / len(gt_set)
