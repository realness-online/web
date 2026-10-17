#!/usr/bin/env bash



main() {
    devs=$(ls /sys/class/net | grep -v lo)
    for dev in $devs; do
        mac_ip=$(ip link show dev $dev \
            | grep link/ether \
            | grep -Po "(?<=06:00:)([0-9a-f]{2}:?){4}"
        )
        ip=$(printf "%d.%d.%d.%d" $(echo "0x${mac_ip}" | sed "s/:/ 0x/g"))
        ip addr add "$ip/30" dev $dev
        ip link set $dev up
    done
}
main
