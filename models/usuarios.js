module.exports ={

    insertar : function (conexion,req,res,funcion,){
        const usuario = req.body.usuario;
        const nombre = req.body.nombre;
        const rol = req.body.rol;
        const password = req.body.password;
        let passwordHash = bcryptjs.hash(password,8)  
        conexion.query('INSERT INTO usuarios SET ?',{usuario:usuario, nombre:nombre,rol:rol, password:passwordHash}, async(error, results) =>{
          if(error){
            console.log(error);
          }else{
            res.send('Alta exitosa')
          }
        }) 
    },  
      
}