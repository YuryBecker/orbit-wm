FROM alpine:3.20

RUN apk add --no-cache \
    bash \
    ca-certificates \
    curl \
    fish \
    git \
    less \
    neovim \
    starship \
    vim

RUN addgroup -g 1000 demo \
    && adduser -D -u 1000 -G demo -h /home/demo demo

COPY home/ /opt/orbit/home-skel/
COPY bin/orbit-container-init.sh /usr/local/bin/orbit-container-init

RUN chmod +x /usr/local/bin/orbit-container-init \
    && chown -R demo:demo /opt/orbit/home-skel

USER 1000:1000

ENV HOME=/home/demo
ENV SHELL=/usr/bin/fish
ENV TERM=xterm-256color

WORKDIR /home/demo

ENTRYPOINT ["/usr/local/bin/orbit-container-init"]
