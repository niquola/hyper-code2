---
name: gcs
description: "Google Cloud Storage client — list and read objects, upload files/content, copy and delete objects, and manage buckets through the Storage JSON API. Use for gs:// paths, GCS buckets and sharing files through cloud storage."
---

# Google Cloud Storage

Uses the active `gcloud` account (or `GOOGLE_ACCESS_TOKEN`) and keeps access tokens only in process memory. Defaults: project `atomic-ehr`, private bucket `niquola-private`, public bucket `niquola-public`.

## Read functions

- `gcs.config({})`
- `gcs.buckets({ project? })`
- `gcs.objects({ bucket, prefix?, delimiter?, maxResults?, all? })`
- `gcs.ls({ scope?, prefix? })`
- `gcs.download({ bucket, object, as?, path? })`
- `gcs.get({ object, scope?, as?, path? })`

## Write functions

These mutate real cloud storage; call only on explicit request:

- `gcs.upload({ bucket, object, content?|file?, contentType? })`
- `gcs.put({ object, content?|file?, scope?, contentType? })`
- `gcs.copy({ srcBucket, srcObject, dstBucket, dstObject, move? })`
- `gcs.remove({ bucket, object })`
- `gcs.ensureBuckets({ project?, location? })` — may create buckets and make the public bucket world-readable.

`gcs.api` is the low-level escape hatch; non-GET routes are writes.
