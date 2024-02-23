-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 06-02-2024 a las 23:34:07
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `autofaros`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `carritos`
--

CREATE TABLE `carritos` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `producto_id` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `precio_total` decimal(10,2) NOT NULL,
  `metodo_envio` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `carritos`
--

INSERT INTO `carritos` (`id`, `usuario_id`, `producto_id`, `cantidad`, `precio_total`, `metodo_envio`) VALUES
(32, 2, 1, 1, 125000.00, NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `productos`
--

CREATE TABLE `productos` (
  `id` int(11) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `codigo` varchar(255) NOT NULL,
  `imagen` varchar(255) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `proveedor` varchar(255) DEFAULT NULL,
  `precio` decimal(10,2) DEFAULT NULL,
  `categoria` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `productos`
--

INSERT INTO `productos` (`id`, `nombre`, `codigo`, `imagen`, `descripcion`, `proveedor`, `precio`, `categoria`) VALUES
(1, 'LOGAN 14/19 S/LUZ DIURNA', '511245', '1707220990278_1686599938236_D_885695-MLA44220613360_122020-B_1024x.jpg', 'OPTICA PARA RENAULT LOGAN ', 'LAM', 125000.00, 'OPTICAS'),
(2, 'AMAROK 12/16', '954768', '1707220990278_1687467610677_LA-OP081129.jpg', 'OPTICA VW AMAROK 14/16', 'LIDERCAR', 190000.00, 'OPTICAS'),
(3, 'CARGO 10/15', '654512', '1707220990278_1687986442538_descarga.jpg', '', 'DAM', 350000.00, 'FAROS CAMIONES'),
(4, 'H4 12V 60/55W', '512142', '1707224803997_1703631533435_12342-PhotoRoom.webp', 'LAMPARA PARA TODO TIPO DE VEHICULO', 'MYL', 5000.00, 'LAMPARAS'),
(5, 'RANGER 13/17', '711894', '1707224803997_1692818189214_images.jpg', 'FARO TRASERO PARA FORD RANGER', 'LIDERCAR', 54000.00, 'FAROS TRASEROS'),
(6, '7 PULGADAS ALTA BAJA POSICION Y GIRO', '654713', '1707224803997_1703631533435_diseno-sin-titulo-161-48e56227160108a62816806301056584-1024-1024.webp', 'Optica universal Led con todas las funciones', 'LAM', 95000.00, 'FAROS LED');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `apellido` varchar(255) DEFAULT NULL,
  `celular` varchar(255) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `localidad` varchar(255) DEFAULT NULL,
  `provincia` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `apellido`, `celular`, `direccion`, `localidad`, `provincia`) VALUES
(1, 'Administrador', 'waltercordobadev@gmail.com', '$2a$10$hSccZlz8.sN30cPIF7m2g.yOxXCuiDT4hdnwWuZNXcPaYppqml7Rm', 'Cordoba', '+543513274715', 'igualdad 88', '142875', '14'),
(2, 'Pedro ', 'pedro@pasculi.com', '$2a$10$7z.MZfZzV5X4RXfYX4bMpOyeJ3yBcEVmb8V4nIHmwSHZkVwIMy1N.', 'Pasculi', '+543513274715', 'Cabrera 59', '140154', '14');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `carritos`
--
ALTER TABLE `carritos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `producto_id` (`producto_id`);

--
-- Indices de la tabla `productos`
--
ALTER TABLE `productos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `codigo` (`codigo`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `carritos`
--
ALTER TABLE `carritos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT de la tabla `productos`
--
ALTER TABLE `productos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `carritos`
--
ALTER TABLE `carritos`
  ADD CONSTRAINT `carritos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `carritos_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`);

--

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;