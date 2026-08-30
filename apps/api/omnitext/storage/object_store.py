"""Local Object Store for raw file persistence."""

import os
import shutil
from typing import BinaryIO

from omnitext.core.config import settings


class ObjectStore:
    """A filesystem-based object store implementing put/get/delete operations."""

    def __init__(self, base_dir: str | None = None) -> None:
        self.base_dir = base_dir or settings.API_STORAGE_DIR
        os.makedirs(self.base_dir, exist_ok=True)

    def put_object(self, path: str, file_obj: BinaryIO) -> str:
        """Save a binary file stream to the object store and return its relative path."""
        full_path = os.path.join(self.base_dir, path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as f:
            shutil.copyfileobj(file_obj, f)
        return path

    def get_object(self, path: str) -> BinaryIO:
        """Retrieve a binary file stream from the object store."""
        full_path = os.path.join(self.base_dir, path)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"File not found in object store: {path}")
        return open(full_path, "rb")

    def delete_object(self, path: str) -> None:
        """Delete a file from the object store if it exists."""
        full_path = os.path.join(self.base_dir, path)
        if os.path.exists(full_path):
            os.remove(full_path)


# Singleton instance
object_store = ObjectStore()
