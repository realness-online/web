#!/bin/bash

# Generate localhost SSL certificates
# This script creates self-signed certificates for local development

echo "Generating localhost SSL certificates..."

# Check if mkcert is available (preferred method)
if command -v mkcert &> /dev/null; then
    echo "Using mkcert to generate certificates..."
    mkcert -install
    mkcert localhost 127.0.0.1 ::1
    mv localhost+2.pem localhost.pem
    mv localhost+2-key.pem localhost-key.pem
    echo "Certificates generated successfully with mkcert!"
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
