import multiprocessing

# Gunicorn configuration for RoadGuard
bind = "0.0.0.0:8000"
workers = 1 # Keep low to save memory on Render Free Tier
timeout = 300 # Allow enough time for TensorFlow inference on cold starts
worker_class = "sync"
