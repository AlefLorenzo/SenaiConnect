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
  test('registers real analytics, billing and invoice download handlers', () => {
    const routes = businessRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: layer.route.methods
      }));

    expect(routes.some((route) => route.path === '/analytics' && route.methods.get)).toBe(true);
    expect(routes.some((route) => route.path === '/billing' && route.methods.get)).toBe(true);
    expect(routes.some((route) => route.path === '/billing/:id/download' && route.methods.get)).toBe(true);
  });


  test('registers the discovery feed and campaign tracking endpoints', () => {
    const routes = businessRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: layer.route.methods
      }));

    expect(routes.some((route) => route.path === '/discovery-feed' && route.methods.get)).toBe(true);
    expect(routes.some((route) => route.path === '/ad-creatives/:id/impression' && route.methods.post)).toBe(true);
    expect(routes.some((route) => route.path === '/ad-creatives/:id/click' && route.methods.post)).toBe(true);
  });

  test('registers protected campaign moderation endpoints', () => {
    const routes = businessRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: layer.route.methods
      }));

    expect(routes.some((route) => route.path === '/admin/campaigns' && route.methods.get)).toBe(true);
    expect(routes.some((route) => route.path === '/admin/campaigns/:id/approve' && route.methods.post)).toBe(true);
    expect(routes.some((route) => route.path === '/admin/campaigns/:id/reject' && route.methods.post)).toBe(true);
  });

});
