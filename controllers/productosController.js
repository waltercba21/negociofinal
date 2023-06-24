const conexion = require('../config/conexion')
const producto = require('../models/producto')
var borrar = require('fs');


module.exports = {

    index : function (req,res){
                res.render('index');
    },

    lista: function (req,res){

        producto.obtener(conexion,function(error,datos){
            res.render('productos', { title: 'Productos', productos:datos });
        })
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

}