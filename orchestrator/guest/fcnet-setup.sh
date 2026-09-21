#!/usr/bin/env bash

# Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Vendored verbatim from the Firecracker CI rootfs, which is fetched in
# guest-setup.sh and unpacked at /opt/fc/squashfs-root. It is the MAC-to-address
# half of brayness-net-up; the route and resolver are ours (those are the two
# things this script does not do).
#
#   sha256 8b0fc2f9ca8fc7d529f1b2b2d33fabe1607cd9d1de4432eccc7cb02a0e91286f
#   origin firecracker-ci/v1.15/aarch64 ubuntu-24.04.squashfs

# This script assigns IP addresses to the existing
# virtual networking devices based on their MAC address.
# It is a simple solution on which Firecracker's integration
# tests are based. Each network device attached in a test will
# assign the next available MAC.
# The IP is obtained by converting the last 4 hexa groups of the MAC into decimals.

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
