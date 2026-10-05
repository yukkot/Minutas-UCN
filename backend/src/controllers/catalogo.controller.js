export const crearCatalogoController = (service) => ({
  async listar(req, res) {
    res.json(await service.listar({ q: req.query.q }));
  },
});
