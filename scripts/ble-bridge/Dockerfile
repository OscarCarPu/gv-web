# Debian base rather than python:3-slim on purpose: the bridge needs PyGObject, and the
# distro package (python3-gi) is built against the distro's own python3. Installing it
# into python:3-slim gives you a `gi` that the image's interpreter cannot import.
FROM debian:bookworm-slim

# gir1.2-glib-2.0 is what provides the Gio typelib the bridge talks D-Bus through.
# No BlueZ packages here: bluetoothd runs on the host and everything reaches it over
# D-Bus, so the container needs no bluez, no /dev access and no extra capabilities.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 python3-gi gir1.2-glib-2.0 \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY bluez.py protocols.py bridge.py ./

EXPOSE 8477

# Runs as root: BlueZ's D-Bus policy grants GattCharacteristic1 / Properties /
# ObjectManager to user root only — the default context may merely address org.bluez,
# so an unprivileged user gets "rejected send message" on the first WriteValue.
ENTRYPOINT ["python3", "-u", "bridge.py"]
CMD ["--port", "8477"]
