# Devcontainer Dockerfile: Node 20 base + Android SDK commandline tools + OpenJDK 17
FROM mcr.microsoft.com/devcontainers/javascript-node:0-20

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    unzip wget git zip curl ca-certificates openjdk-17-jdk-headless && \
    rm -rf /var/lib/apt/lists/*

# Android SDK location
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=${PATH}:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools

RUN mkdir -p ${ANDROID_SDK_ROOT}

# Download command line tools
RUN cd /tmp && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip -O /tmp/cmdline-tools.zip && \
    mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools && \
    unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_SDK_ROOT}/cmdline-tools && \
    # move folder to 'latest' to match sdkmanager expectation
    mv ${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools ${ANDROID_SDK_ROOT}/cmdline-tools/latest && \
    rm /tmp/cmdline-tools.zip

# Create licenses dir so sdkmanager can accept licenses
RUN mkdir -p ${ANDROID_SDK_ROOT}/licenses

# Ensure gradlew is executable later; copy is not needed here
WORKDIR /workspace

CMD ["/bin/bash"]
