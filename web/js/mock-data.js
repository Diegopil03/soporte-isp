

export const tickets = [
  {
    id: "ISP-8821",
    cliente: "Juan Pérez",
    zona: "Norte",
    prioridad: "alta",
    estado: "en_espera",
    bloque: "Mismo día",
    direccion: "Av. Insurgentes Nte, Lindavista, CDMX",
    ubicacion: { lat: 19.4972, lng: -99.1352 },
  },
  {
    id: "ISP-8822",
    cliente: "María García",
    zona: "Sur",
    prioridad: "media",
    estado: "asignado",
    bloque: "Esta semana",
    direccion: "Coyoacán, CDMX",
    ubicacion: { lat: 19.3470, lng: -99.1610 },
  },
  {
    id: "ISP-8823",
    cliente: "Carlos Ruiz",
    zona: "Centro",
    prioridad: "baja",
    estado: "en_revision",
    bloque: "Programado",
    direccion: "Roma Norte, CDMX",
    ubicacion: { lat: 19.4169, lng: -99.1621 },
  },
  {
    id: "ISP-8824",
    cliente: "Lucía Torres",
    zona: "Centro",
    prioridad: "alta",
    estado: "en_visita",
    bloque: "Hoy PM",
    direccion: "Condesa, CDMX",
    ubicacion: { lat: 19.4117, lng: -99.1736 },
  },
  {
    id: "ISP-8825",
    cliente: "Roberto Mendoza",
    zona: "Norte",
    prioridad: "media",
    estado: "nuevo",
    bloque: "Mañana AM",
    direccion: "Polanco, CDMX",
    ubicacion: { lat: 19.4328, lng: -99.2001 },
  },
];


export const tecnicos = [
  {
    id: "TEC-01",
    nombre: "Roberto Mendoza",
    zona: "Norte",
    lat: 19.4226,
    lng: -99.1232,
    activo: true
  },
  {
    id: "TEC-02",
    nombre: "Lucía Torres",
    zona: "Centro",
    lat: 19.4126,
    lng: -99.1532,
    activo: true
  }
];

export const usuarioActual = {
  id: "ISP-9942",
  nombre: "Juan Pérez",
  rol: "coordinador",
  zona: "Zona Norte - Sector 4"
};

export const inventoryItems = [
  {
    id: "fibra-sm-1km",
    name: "Fibra óptica SM 1km",
    category: "Fibra",
    stock: 12,
    minStock: 10,
    unit: "rollos",
    sku: "FO-SM-1KM",
  },
  {
    id: "ont-huawei",
    name: "ONT Huawei HG8145",
    category: "ONT",
    stock: 3,
    minStock: 5,
    unit: "unidades",
    sku: "ONT-HUA-8145",
  },
  {
    id: "conector-sc",
    name: "Conector SC/APC",
    category: "Conectores",
    stock: 45,
    minStock: 20,
    unit: "pzas",
    sku: "CON-SC-APC",
  }
];

