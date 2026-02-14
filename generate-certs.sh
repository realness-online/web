#!/bin/bash

# Generate localhost SSL certificates for local development.
# Includes realness.local for LAN access from phone/tablet.

if command -v mkcert &> /dev/null; then
    echo "Resetting mkcert root CA..."
    mkcert -uninstall 2>/dev/null || true
    rm -rf "$(mkcert -CAROOT)"
fi

rm -f localhost.pem localhost-key.pem rootCA.pem
echo "Generating localhost SSL certificates..."

# Check if mkcert is available (preferred method)
if command -v mkcert &> /dev/null; then
    echo "Using mkcert..."
    mkcert -install
    mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost 127.0.0.1 ::1 realness.local
    cp "$(mkcert -CAROOT)/rootCA.pem" ./rootCA.pem
    echo "Certificates generated successfully!"
    echo ""
    echo "LAN access: https://realness.local:8080"
    echo "Install rootCA.pem on your phone to avoid cert warnings (Files → this project → rootCA.pem)"
else
    echo "mkcert not found, using OpenSSL..."

    # Generate private key
    openssl genrsa -out localhost-key.pem 2048

    # Generate certificate signing request
    openssl req -new -key localhost-key.pem -out localhost.csr -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

    # Generate self-signed certificate
    openssl x509 -req -in localhost.csr -signkey localhost-key.pem -out localhost.pem -days 365

    # Clean up CSR file
    rm localhost.csr

    echo "Certificates generated successfully with OpenSSL!"
fi

echo "Certificate files created:"
echo "- localhost.pem (certificate)"
echo "- localhost-key.pem (private key)"
echo "- rootCA.pem (install on phone for LAN access)"
