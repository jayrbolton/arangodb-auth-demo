#!/bin/bash

# Deploy the foxx service and run tests

echo 'password' > pass

foxx upgrade --dev /basic --server http://localhost:8529 -u root -p pass -v 

foxx test /basic -u root -p pass

rm pass
