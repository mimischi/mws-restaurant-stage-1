/**
 * Common database helper functions.
 */
class DBHelper {
  /**
   * Open Database
   */
  static openDatabase() {
    if (!navigator.serviceWorker) {
      return Promise.resolve();
    }
  
    return idb.open('restaurants', 1, function(upgradeDb) {
      upgradeDb.createObjectStore('restaurants', { keyPath: 'id' });
      upgradeDb.createObjectStore('reviews', { keyPath: 'id' });
      upgradeDb.createObjectStore('reviewsToBeSynced', { keyPath: 'id' });
    });
  }

  /**
   * Database URL.
   */
  static get DATABASE_URL() {
    const port = 1337 // Change this to your server port
    return `http://localhost:${port}`;
  }

  /**
   * Grab all restaurants from the cache.
   */
  static getCachedRestaurants() {
    return DBHelper.openDatabase().then(db => {
      const tx = db.transaction("restaurants");
      const store = tx.objectStore("restaurants");

      return store.getAll();
    })
  }

  /**
   * Grab specific restaurant from the cache
   */
  static getCachedRestaurant(id) {
    return DBHelper.openDatabase().then(db => {
      const tx = db.transaction("restaurants");
      const store = tx.objectStore("restaurants");

      return store.get(parseInt(id));
    })
  }

  /**
   * Grab all reviews from the cache.
   */
  static getCachedReviews() {
    return DBHelper.openDatabase().then(db => {
      const tx = db.transaction("reviews");
      const store = tx.objectStore("reviews");

      return store.getAll();
    })
  }

  /**
   * Grab all reviews to be synced.
   */
  static getReviewsToBeSynced() {
    return DBHelper.openDatabase().then(db => {
      const tx = db.transaction("reviewsToBeSynced");
      const storeToBeSynced = tx.objectStore("reviewsToBeSynced");

      return storeToBeSynced.getAll();
    })
  }

  /**
   * Grab all reviews, those cached and those to be synced.
   */
  static getAllReviews() {
    let cachedReviews = DBHelper.getCachedReviews().then(reviews => reviews)
    let offlineReviews = DBHelper.getReviewsToBeSynced().then(reviews => reviews);

    const promise = Promise.all([cachedReviews, offlineReviews])
    .then(reviews => [...reviews[0], ...reviews[1]])

    return promise
  }

  /**
   * Write all restaurants to store
   */
  static writeRestaurantstoCache(restaurants) {
    return DBHelper.openDatabase().then(db => {
      const tx = db.transaction("restaurants", "readwrite");
      const store = tx.objectStore("restaurants");

      for (let restaurant of restaurants) {
        store.put(restaurant)
      }

      return tx.complete;
    })
  }

  /**
   * Write all reviews to store
   */
  static writeReviewstoCache(reviews) {
    return DBHelper.openDatabase().then(db => {
      const tx = db.transaction("reviews", "readwrite");
      const store = tx.objectStore("reviews");

      for (let review of reviews) {
        store.put(review)
      }

      return tx.complete;
    })
  }

  /**
   * Write all reviews to store, which should be send when we get back online again
   */
  static writeReviewsToBeSynced(reviews) {
    return DBHelper.openDatabase().then(db => {
      const tx = db.transaction("reviewsToBeSynced", "readwrite");
      const store = tx.objectStore("reviewsToBeSynced");

      for (let review of reviews) {
        store.put(review)
      }

      return tx.complete;
    })
  }

  /**
   * Remove all reviews that needed to be synced from IDB.
   */
  static clearReviewsToBeSynced(reviews) {
    return DBHelper.openDatabase().then(db => {
      const tx = db.transaction("reviewsToBeSynced", "readwrite");
      const store = tx.objectStore("reviewsToBeSynced");

      store.clear();

      return tx.complete;
    })
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    DBHelper.getCachedRestaurants()
    .then(restaurants => {
      if (restaurants.length !== 0) {
        return callback(null, restaurants)
      }

      fetch(`${DBHelper.DATABASE_URL}/restaurants/`)
      .then(response => response.json())
      .then(restaurants => {

        // Write all fetched restaurants to cache and return the request.
        DBHelper.writeRestaurantstoCache(restaurants)
        .then(() => console.log("Added all restaurants to IndexedDB."))
        .catch(error => console.log(error))
        .finally(() => callback(null, restaurants))
      })
      .catch(error => callback(`Request failed. Returned status of ${error.statusText}`, null));
    });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) { // Got the restaurant
          callback(null, restaurant);
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }

  /**
   * Send review to API
   */
  static sendReview(review) {
    fetch(`${DBHelper.DATABASE_URL}/reviews/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(review)
    })
    .then(response => response.json())
    .then(response => console.log(`Success! Send review to API!`))
    .catch(error => console.log`Failed to send review to API. Returned status of ${error.statusText}`)
  }

  /**
   * Fetch all reviews.
   */
  static fetchReviews(id, callback) {
    DBHelper.getAllReviews()
    // DBHelper.getCachedReviews()
    .then(reviews => {
      if (reviews.length !== 0) {
        return callback(null, reviews);
      }

      fetch(`${DBHelper.DATABASE_URL}/reviews/`)
      .then(response => response.json())
      .then(reviews => {

        // Write all fetched reviews to cache and return the request.
        DBHelper.writeReviewstoCache(reviews)
        .then(() => console.log("Added all reviews to IndexedDB."))
        .catch(error => console.log(error))
        .finally(() => callback(null, reviews))
      })
      .catch(error => callback(`Request failed. Returned status of ${error.statusText}`, null));

      // The API is weird. It does not retrieve all manually added reviews
      // when polling /reviews/. It does it correctly, when polling the API
      // for the current restaurant ID.
      fetch(`${DBHelper.DATABASE_URL}/reviews/?restaurant_id=${id}`)
      .then(response => response.json())
      .then(reviews => {

        // Write all fetched reviews to cache and return the request.
        DBHelper.writeReviewstoCache(reviews)
        .then(() => console.log("Added all reviews to IndexedDB."))
        .catch(error => console.log(error))
        .finally(() => callback(null, reviews))
      })
      .catch(error => callback(`Request failed. Returned status of ${error.statusText}`, null));
    });
  }

  /**
   * Fetch a review by its ID.
   */
  static fetchReviewsByRestaurantId(id, callback) {
    // fetch all reviews with proper error handling.
    DBHelper.fetchReviews(id, (error, reviews) => {
      if (error) {
        callback(error, null);
      } else {
        const review = reviews.filter(r => r.restaurant_id == id);
        if (review) { // Got the review
          callback(null, review);
        } else { // Review does not exist in the database
          callback('Review does not exist', null);
        }
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  static updateFavoriteAPI(restaurant_id, is_favorite) {
    const updateFavoriteURL = `${DBHelper.DATABASE_URL}/restaurants/${restaurant_id}/?is_favorite=${is_favorite}`;
    fetch(updateFavoriteURL, { method: 'PUT'})
      .then(() => {
        DBHelper.openDatabase().then(db => {
          const tx = db.transaction("restaurants", "readwrite");
          const store = tx.objectStore("restaurants");

          store.get(restaurant_id).then((restaurant) => {
            restaurant.is_favorite = is_favorite;
            store.put(restaurant);
          });

          // return tx.complete;
        });
      })
      .catch(e => console.log(e));
  }
  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return (`/img/${restaurant.photograph}.jpg`);
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  }

}
