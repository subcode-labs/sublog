# Data Directory

This directory contains persistent data for the Sublog application.

## Contents

- `sublog.db`: SQLite database file used by the application

## Notes

- This directory is mounted into the Docker container at `/data`
- The application is configured to store its database at `/data/sublog.db` inside the container
- Do not delete this directory while the application is running
