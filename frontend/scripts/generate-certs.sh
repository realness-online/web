#!/bin/bash

# Generate localhost SSL certificates for local development.
# Includes realness.local for LAN access from phone/tablet.

if ! grep -q 'realness.local' /etc/hosts 2>/dev/null; then
  echo "realness.local is not in /etc/hosts. Add it for local access:"
  echo "  echo '127.0.0.1 realness.local' | sudo tee -a /etc/hosts"
  echo ""
fi

if command -v mkcert &> /dev/null; then
    echo "Resetting mkcert root CA..."
    mkcert -uninstall 2>/dev/null || true
    rm -rf "$(mkcert -CAROOT)"
fi

rm -f realness.local.pem realness.local-key.pem localhost.pem localhost-key.pem rootCA.pem
echo "Generating SSL certificates for Vite (realness.local + localhost)..."

# Check if mkcert is available (preferred method)
if command -v mkcert &> /dev/null; then
    echo "Using mkcert..."
    mkcert -install
    mkcert -key-file realness.local-key.pem -cert-file realness.local.pem localhost 127.0.0.1 ::1 realness.local
    cp "$(mkcert -CAROOT)/rootCA.pem" ./rootCA.pem
    echo "Certificates generated successfully!"
    echo ""
    echo "Dev server (with certs): https://realness.local (Vite uses port 443)"
    echo "Install rootCA.pem on your phone to avoid cert warnings (Files → this project → rootCA.pem)"
else
    echo "mkcert not found, using OpenSSL..."

    # Generate private key
    openssl genrsa -out realness.local-key.pem 2048

    # Generate certificate signing request
    openssl req -new -key realness.local-key.pem -out localhost.csr -subj "/C=US/ST=State/L=City/O=Organization/CN=realness.local"

    # Generate self-signed certificate
    openssl x509 -req -in localhost.csr -signkey realness.local-key.pem -out realness.local.pem -days 365

    # Clean up CSR file
    rm localhost.csr

    echo "Certificates generated successfully with OpenSSL!"
fi

echo "Certificate files created:"
echo "- realness.local.pem (certificate — matches vite.config.js)"
echo "- realness.local-key.pem (private key)"
echo "- rootCA.pem (install on phone for LAN access, mkcert only)"
