const conexion = require('../config/conexion')
const producto = require('../models/producto')
var borrar = require('fs');


module.exports = {
    index : function (req,res){
                res.render('index');
    },
    lista: function (req, res) {
        const categoria = req.query.categoria;
        if (categoria) {
            producto.obtenerPorCategoria(conexion, categoria, function (error, productos) {
                if (error) {
                    console.log('Error al obtener productos:', error);
                } else {
                    console.log('Productos obtenidos:', productos);
                    res.render('productos', { productos: productos });
                }
            });
        } else {
            producto.obtener(conexion, function (error, productos) {
                if (error) {
                    console.log('Error al obtener productos:', error);
                } else {
                    console.log('Productos obtenidos:', productos);
                    res.render('productos', { productos: productos });
                }
            });
        }
    },
    
    crear: function(req,res){
        res.render('crear')
    },
    guardar: function(req,res){  
        producto.insertar(conexion,req.body,req.file,function(error){
             res.redirect('/productos');
        })
    },
    eliminar: function(req,res){
       producto.retornarDatosId(conexion,req.params.id,function (error, registros){
        var nombreImagen = '/public/images/' + (registros [0].imagen);
        
        if(borrar.existsSync(nombreImagen)){
            borrar.unlinkSync(nombreImagen);
        }
        producto.borrar(conexion,req.params.id, function (error){

            res.redirect('/productos');
        })
       });
    },

    editar : function (req,res){
        producto.retornarDatosId(conexion,req.params.id,function (error, registros){
            console.log(registros[0])
            res.render('editar', {producto: registros[0]});
        });
    },
    
    actualizar: function (req, res) {    
    if(req.file){
        if(req.file.filename){
            producto.retornarDatosId(conexion,req.body.id,function (error, registros){
                var nombreImagen = '/public/images/' + (registros [0].imagen);
                
                if(borrar.existsSync(nombreImagen)){
                    borrar.unlinkSync(nombreImagen);
                }
               producto.actualizarArchivo(conexion,req.body, req.file, function (error){})

               });
        }
    }
    if(req.body.nombre){producto.actualizar(conexion,req.body,function(error){

        });
    }
    res.redirect('/productos');
    
},
    carrito : function (req,res){
        res.render('carrito');
},
    panelControl: function (req,res){

    producto.obtener(conexion,function(error,datos){
        res.render('panelControl', { title: 'Productos', productos:datos });
    })
},
buscarPorNombre: function (req, res) {
    const nombre = req.query.query; // 

    if (!nombre) {
        producto.obtenerTodos(conexion, (error, productos) => {
            if (error) {
                console.error(error);
                res.status(500).send('Error interno del servidor');
                return;
            }
            res.json({ productos });
        });
    } else {
        producto.obtenerPorNombre(conexion, nombre, (error, productos) => {
          if (error) {
            console.error(error);
            res.status(500).send('Error interno del servidor');
            return;
          }

          res.json({ productos });
        });
    }   
},
todos: function (req, res) {
    producto.obtener(conexion, function (error, productos) {
        if (error) {
            console.log('Error al obtener productos:', error);
        } else {
            console.log('Productos obtenidos:', productos);
            res.render('productos', { productos: productos });
        }
    });
},
}