/**
 * BURKE APP · carga de los datos que ya teníais en la versión de Claude.
 * Ejecuta cargarDatosIniciales() UNA sola vez, después de prepararHoja().
 * Luego puedes borrar este archivo.
 */
const DATOS_INICIALES = {
 "personal": [
  {
   "autonomo": false,
   "coche": false,
   "email": "",
   "id": "pmvqm6cn6maja",
   "imp": 0,
   "modo": "cache",
   "nombre": "Juanma",
   "notas": "",
   "rol": "",
   "ss": true,
   "tallas": "",
   "tel": "",
   "zona": ""
  },
  {
   "autonomo": false,
   "coche": false,
   "email": "",
   "id": "pmvqm6o2zxy18",
   "imp": 0,
   "modo": "cache",
   "nombre": "Myriam",
   "notas": "",
   "rol": "",
   "ss": true,
   "tallas": "",
   "tel": "",
   "zona": ""
  },
  {
   "autonomo": false,
   "coche": false,
   "email": "",
   "id": "pmvqm6wt9u1ru",
   "imp": 0,
   "modo": "cache",
   "nombre": "Bailarina 1",
   "notas": "",
   "rol": "",
   "ss": true,
   "tallas": "",
   "tel": "",
   "zona": ""
  },
  {
   "autonomo": false,
   "coche": false,
   "email": "",
   "id": "pmvqm7lmu75en",
   "imp": 0,
   "modo": "cache",
   "nombre": "Bailarina 2",
   "notas": "",
   "rol": "",
   "ss": true,
   "tallas": "",
   "tel": "",
   "zona": ""
  },
  {
   "autonomo": false,
   "coche": false,
   "email": "",
   "id": "pmvqm7rk3oxtj",
   "imp": 0,
   "modo": "cache",
   "nombre": "Bailarina 3",
   "notas": "",
   "rol": "",
   "ss": true,
   "tallas": "",
   "tel": "",
   "zona": ""
  },
  {
   "autonomo": false,
   "coche": false,
   "email": "",
   "id": "pmvqmj6j9x4oa",
   "imp": 0,
   "modo": "cache",
   "nombre": "Garza 1",
   "notas": "",
   "rol": "",
   "ss": true,
   "tallas": "",
   "tel": "",
   "zona": ""
  },
  {
   "autonomo": false,
   "coche": false,
   "email": "",
   "id": "pmvqmjb2m1j80",
   "imp": 0,
   "modo": "cache",
   "nombre": "Garaza 2",
   "notas": "",
   "rol": "",
   "ss": true,
   "tallas": "",
   "tel": "",
   "zona": ""
  },
  {
   "autonomo": false,
   "coche": false,
   "email": "",
   "id": "pmvqmo9ifglfv",
   "imp": 0,
   "modo": "cache",
   "nombre": "Musicos",
   "notas": "",
   "rol": "",
   "ss": true,
   "tallas": "",
   "tel": "",
   "zona": ""
  }
 ],
 "clientes": [
  {
   "cif": "",
   "contactos": [
    {
     "cargo": "Concejal",
     "email": "",
     "id": "kmvnswm1vsvj7",
     "nombre": "Amador",
     "notas": "",
     "tel": ""
    }
   ],
   "direccion": "",
   "email": "",
   "id": "cmvnsuqzve97f",
   "nombre": "La Ribera",
   "notas": "",
   "tel": "",
   "tipo": "Ayuntamiento o administración",
   "web": ""
  }
 ],
 "agentes": [
  {
   "cif": "",
   "comision": "",
   "contactos": [],
   "direccion": "",
   "email": "",
   "id": "gmvnt27kj2fwx",
   "nombre": "Salvador Navarro",
   "notas": "",
   "tel": "",
   "tipo": "Agente comercial",
   "web": "",
   "zona": ""
  }
 ]
};
const CONFIG_INICIAL = {"cats": ["Dietas"], "inv": {"altavoces": 3000, "kumbre": 2500, "presos": null}};
function cargarDatosIniciales(){
  let n = 0;
  Object.keys(DATOS_INICIALES).forEach(coll => DATOS_INICIALES[coll].forEach(o => { put(coll, o); n++; }));
  putConfig(CONFIG_INICIAL);
  return n + " registros cargados";
}
