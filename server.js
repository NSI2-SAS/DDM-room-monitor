const express = require('express');
const fs = require('fs');
const http = require("http");
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 80;
const GRAPHQL_SERVER_URL = process.env.DDMSERVER || '';
const TOKEN = process.env.TOKEN || ""; // Remplace by token 

const query = `
query {
  domains {
    id
    name
    devices {
      id
      name
      connection {
        state
      }
      clockingState {
        locked
        grandLeader
        followerWithoutLeader
        multicastLeader
        unicastLeader
        unicastFollower
        muteStatus
        frequencyOffset
      }
    }
  }
}
`;

let domainData = [];
let domainMetadata = {};

// Charger les métadonnées au démarrage du programme
const metadataFilePath = path.resolve('domain_metadata.json');
if (fs.existsSync(metadataFilePath)) {
  const metadata = fs.readFileSync(metadataFilePath);
  domainMetadata = JSON.parse(metadata);
}

// Middleware pour servir les fichiers statiques et parser le body des requêtes
app.use(express.static('public'));
app.use(bodyParser.json());

// Route pour servir index.html
app.get('/', (req, res) => {
  res.sendFile(path.resolve('index2.html'));
});

// Fonction pour faire une requête HTTP POST vers le serveur GraphQL
function fetchGraphQLData(query) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: GRAPHQL_SERVER_URL,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${TOKEN}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(JSON.stringify({ query }));
    req.end();
  });
}

// Fonction pour mettre à jour les domaines toutes les 10 secondes
async function updateDomains() {
  try {
    const data = await fetchGraphQLData(query);

    if (data.errors) {
      console.error(data.errors);
      return;
    }

    domainData = data.data.domains.map((domain) => {
      const devices = domain.devices;
	  console.log(JSON.stringify(domain))
      const onlineCount = devices.filter(
        (device) => device.connection.state === 'ESTABLISHED'
      ).length;
      const offlineCount = devices.length - onlineCount;
      const clockingStates = devices.map((device) => ({
        name: device.name,
        clockingState: device.clockingState,
      }));

      const allDisconnectedDevicesOff = devices
        .some(device => device.connection.state == 'DISCONNECTED' && domainMetadata[domain.name]?.[device.name]?.off);

      return {
        domainName: domain.name,
        onlineCount,
        offlineCount,
        clockingStates,
        off: allDisconnectedDevicesOff,
      };
    });

  } catch (error) {
    console.error('An error occurred while fetching data:', error);
  }
}

// Mettre à jour les domaines toutes les 10 secondes
setInterval(updateDomains, 5000);

// Route pour obtenir les informations des domaines
app.get('/DDM-domains', (req, res) => {
  res.json(domainData);
});

// Route GET pour obtenir les métadonnées d'un domaine spécifique
app.get('/domain-config', (req, res) => {
  const domainName = req.query.domain;
  if (!domainName) {
    return res.status(400).json({ error: 'Domain name is required' });
  }
  
  if (!domainMetadata[domainName]) {
    domainMetadata[domainName] = {};
  }

  const domain = domainData.find(d => d.domainName === domainName);
  if (domain) {
    const currentDevices = domain.clockingStates.map(device => device.name);
    const metadataDevices = Object.keys(domainMetadata[domainName]);

    // Ajouter les nouveaux devices manquants
    currentDevices.forEach(deviceName => {
      if (!metadataDevices.includes(deviceName)) {
        domainMetadata[domainName][deviceName] = { off: true };
      }
    });

    // Supprimer les devices obsolètes
    metadataDevices.forEach(deviceName => {
      if (!currentDevices.includes(deviceName)) {
        delete domainMetadata[domainName][deviceName];
      }
    });

    saveMetadata();
  }
  
  res.json(domainMetadata[domainName]);
});

// Route POST pour mettre à jour les métadonnées d'un domaine spécifique
app.post('/domain-config', (req, res) => {
  const domainName = req.query.domain;
  const metadata = req.body;
  if (!domainName || !metadata) {
    return res.status(400).json({ error: 'Domain name and metadata are required' });
  }
  
  domainMetadata[domainName] = metadata;
  saveMetadata();
  res.status(200).json({ message: 'Metadata updated successfully' });
});

// Sauvegarder les métadonnées sur le disque
function saveMetadata() {
  fs.writeFileSync(metadataFilePath, JSON.stringify(domainMetadata, null, 2));
}

// Middleware pour sauvegarder les métadonnées à chaque modification
app.use((req, res, next) => {
  res.on('finish', saveMetadata);
  next();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  updateDomains(); // Mettre à jour les domaines dès le démarrage du serveur
});
