const conexion = require('../config/conexion')
const usuario= require('../models/usuario')
const bcryptjs= require('bcryptjs')
const { validationResult } = require ('express-validator')
var borrar = require('fs');

module.exports = {

    register: (req,res)=>{
        return res.render('register');
    },
    processRegister: (req, res)=>{
       const resultValidation= validationResult(req);
        
       if(resultValidation.errors.length > 0){
        return res.render('register', {
            errors : resultValidation.mapped(),
            oldData : req.body
        });
       }
       
       usuario.crear(conexion,req.body,function(error){
        res.render('login');
   })
    },
    login: (req,res)=>{
        return res.render('login');
    },
    lista : (req,res)=>{
        usuario.obtener(conexion,function(error,datos){
            res.render('profile', { title: 'Usuarios', usuarios:datos });
        })
    },
    profile: (req,res)=>{
        return res.render('profile');
    }


}