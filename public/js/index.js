document.addEventListener('DOMContentLoaded', (event) => {
    console.log('DOM completamente cargo y analizado');
const fila = document.querySelector ('.contenedor-carrousel');
const peliculas = document.querySelectorAll('.pelicula');
const flechaIzquierda = document.getElementById('flecha-izquierda');
const flechaDerecha = document.getElementById('flecha-derecha');

// ---------------EVENT LISTENER PARA LA FLECHA DERECHA--------//

flechaDerecha.addEventListener('click', ( ) =>{
    fila.scrollLeft += fila.offsetWidth;

    const indicadorActivo = document.querySelector('.indicadores .activo');
    //le preguntamos si tiene un elemento a la derecha, en caso de que lo tenga accedemos
    if(indicadorActivo.nextSibling){
        indicadorActivo.nextSibling.classList.add('activo');
        indicadorActivo.classList.remove('activo');
    }   
});

// ---------------EVENT LISTENER PARA LA FLECHA IZQUIERDA--------//
flechaIzquierda.addEventListener('click', ( ) =>{
    fila.scrollLeft -= fila.offsetWidth;

    const indicadorActivo = document.querySelector('.indicadores .activo');
    //le preguntamos si tiene un elemento a la derecha, en caso de que lo tenga accedemos
    if(indicadorActivo.previousSibling){
        indicadorActivo.previousSibling.classList.add('activo');
        indicadorActivo.classList.remove('activo');
    }  
});    



// ---------------PAGINACION--------------------------------//
//---CALCULAMOS CUANTAS PAGINAS TENEMOS EN EL CARROUSEL 
const numeroPaginas = Math.ceil(peliculas.length / 3);
for (let i = 0; i < numeroPaginas; i++){
    //POR CADA PAGINA DEL CARROUSEL QUEREMOS CREAR UN BOTON 
    const indicador = document.createElement('button');
    //LE DAMOS LA FUNCIONALIDAD DE ACTIVO AL BOTON 
    if(i===0){
        indicador.classList.add ('activo');
    }
    //A ESE BOTON CREADO LO QUEREMOS COLOCAR EN CLASS .INDICADORES
    document.querySelector('.indicadores').appendChild(indicador);
    
    //LE DAMOS LA FUNCIONALIDAD AL BOTON
    indicador.addEventListener ('click', (e)=>{
        fila.scrollLeft = i * fila.offsetWidth;
    
    //Hacemos que marque el boton activo y desmarque el inactivo
    document.querySelector('.indicadores .activo').classList.remove('activo');
    e.target.classList.add('activo');
    })

}

// ------ Trabajamos con el HOVER de las imagenes ------//

// (peliculas) es un arreglo que vamos a iterar

peliculas.forEach(pelicula => {
  pelicula.addEventListener('click', () => {
    console.log('Película clickeada:');
    const imagen = pelicula.querySelector('.imagen-carrusel');
    const categoria = imagen.getAttribute('data-categoria');
    console.log('Categoría:', categoria); 
    window.location.href = `/productos?categoria=${categoria}`;
  });
});

  fila.addEventListener('mouseleave', () => {
    console.log('mouse salió del carrousel');
    peliculas.forEach(pelicula => pelicula.classList.remove('hover'));
  });
// Suponiendo que tus imágenes tienen una clase 'imagen-carrusel' y el nombre de la categoría está en un atributo 'data-categoria'
const imagenesCarrusel = document.querySelectorAll('.imagen-carrusel');
console.log('Imágenes del carrusel:', imagenesCarrusel.length);

imagenesCarrusel.forEach(imagen => {
  imagen.addEventListener('click', () => {
    console.log('Imagen del carrusel clickeada:');
    const categoria = imagen.getAttribute('data-categoria');
    console.log('Categoría:', categoria); 
    window.location.href = `/productos?categoria=${categoria}`;
  });
});
});
 