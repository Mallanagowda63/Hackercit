FROM node:18-alpine
# sandbox image: minimal runtime used by worker to launch isolated containers
# In production this should be a hardened container with resource limits
RUN apk add --no-cache bash docker-cli
WORKDIR /sandbox
COPY ./entrypoint.sh ./
ENTRYPOINT ["/sandbox/entrypoint.sh"]
