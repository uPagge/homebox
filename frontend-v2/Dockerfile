FROM node:22-alpine

WORKDIR /app
COPY .output /app/.output

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
EXPOSE 3000

ENTRYPOINT []
CMD ["node", "/app/.output/server/index.mjs"]
