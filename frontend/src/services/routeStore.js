/**
 * Simple in-memory store to pass selected route data from route.js to journey.js
 */

let _store = {
    selectedRoute: null,   // OSRM route object (geometry, distance, duration)
    potholes: [],          // Potholes along the route
    routeCoords: [],       // Array of [lat, lng] for the selected route polyline
    destination: null      // { lat, lng, label }
};

export const routeStore = {
    setRoute(route, potholes, routeCoords, destination) {
        _store.selectedRoute = route;
        _store.potholes = potholes;
        _store.routeCoords = routeCoords;
        _store.destination = destination;
    },

    getRoute() {
        return _store.selectedRoute;
    },

    getPotholes() {
        return _store.potholes;
    },

    getRouteCoords() {
        return _store.routeCoords;
    },

    getDestination() {
        return _store.destination;
    },

    clear() {
        _store = { selectedRoute: null, potholes: [], routeCoords: [], destination: null };
    }
};
