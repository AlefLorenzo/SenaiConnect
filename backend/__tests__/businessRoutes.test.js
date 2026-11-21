const businessRouter = require('../routes/businessRoutes');

describe('business routes', () => {
  test('keeps the generic company profile route after the /my-business route', () => {
    const routes = businessRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: layer.route.methods
      }));

    const myBusinessIndex = routes.findIndex(
      (route) => route.path === '/my-business' && route.methods.get
    );
    const genericProfileIndex = routes.findIndex(
      (route) => route.path === '/:id' && route.methods.get
    );

    expect(myBusinessIndex).toBeGreaterThanOrEqual(0);
    expect(genericProfileIndex).toBeGreaterThan(myBusinessIndex);
  });
});
