import multiprocessing

# Gunicorn configuration for RoadGuard
bind = "0.0.0.0:8000"
workers = 1 # Keep low to save memory on Render Free Tier
timeout = 120 # Increase timeout for TensorFlow inference
worker_class = "sync"
