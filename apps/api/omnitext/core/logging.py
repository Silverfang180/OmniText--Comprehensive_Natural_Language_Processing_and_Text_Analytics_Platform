"""Structured Logging Configuration."""

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any


class JSONFormatter(logging.Formatter):
    """Format logs as structured JSON strings."""

    def format(self, record: logging.LogRecord) -> str:
        """Format the specified record as structured JSON."""
        log_obj: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Include custom extra fields if attached to the record
        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id
        if hasattr(record, "task"):
            log_obj["task"] = record.task
        if hasattr(record, "model_id"):
            log_obj["model_id"] = record.model_id
        if hasattr(record, "latency_ms"):
            log_obj["latency_ms"] = record.latency_ms
        if hasattr(record, "input_size"):
            log_obj["input_size"] = record.input_size
        if hasattr(record, "outcome"):
            log_obj["outcome"] = record.outcome

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj)


def setup_logging(debug: bool = False) -> logging.Logger:
    """Configure root and application loggers."""
    log_level = logging.DEBUG if debug else logging.INFO

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers to avoid duplicates
    for existing_handler in root_logger.handlers[:]:
        root_logger.removeHandler(existing_handler)

    root_logger.addHandler(handler)

    app_logger = logging.getLogger("omnitext")
    app_logger.setLevel(log_level)
    return app_logger


logger = setup_logging()
