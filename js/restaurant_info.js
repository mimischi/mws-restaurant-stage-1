let restaurant;
let reviews;
var map;

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  fetchReviews();
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
  });
}


/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}

/**
 * Text for favorite button.
 */
favoriteButtonText = (favorite) => {
  return !favorite ? 'Add to favorites' : 'Remove from favorites';
}

/**
 * Account for possible values of is_favorite.
 */
formatFavorite = (favorite) => {
  if (favorite === undefined || favorite === "undefined" || favorite === "false" || favorite === false) {
    return false
  }
  return true
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img';
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = restaurant.name + ' logo';

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  const fav = document.createElement('a');
  fav.style.float = 'right';
  fav_status = formatFavorite(restaurant.is_favorite);
  fav.innerHTML = favoriteButtonText(fav_status);
  fav.title = `Add ${restaurant.name} to your favorites.`;
  fav.href = '#';
  name.append(fav);

  fav.addEventListener('click', (event) => {
    event.preventDefault();
    console.log(`Pressed favorite for ${restaurant.name}!`);
    restaurant.is_favorite = !fav_status;
    const newText = favoriteButtonText(fav_status);
    fav_status = !fav_status;
    fav.innerHTML = newText; 

    DBHelper.updateFavoriteAPI(restaurant.id, !fav_status)
  });
  
  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fillReviewsHTML();
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    const formattedHours = operatingHours[key].replace(", ", "\n")
    time.innerHTML = formattedHours;
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Fetch all reviews for a specific restaurant. Also include reviews to be synced!
 */
fetchReviews = () => {
  DBHelper.fetchReviews((error, reviews) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.reviews = reviews
    }
  });
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (allReviews = self.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  container.appendChild(title);


  const restaurantID = getParameterByName('id');
  reviews = allReviews.filter(review => review.restaurant_id == restaurantID);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  const head = document.createElement('p');
  // const content = document.createElement('p');

  head.className = 'reviewer-date';
  // content.className = 'review-content';

  li.appendChild(head);
  // li.appendChild(content);
  const headSelector = document.getElementsByClassName('reviewer-date')[0];
  // const contentSelector = document.getElementsByClassName('review-content')[0];

  const name = document.createElement('p');
  name.innerHTML = review.name;
  name.className = 'reviewer';
  head.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = new Date(review.createdAt).toLocaleString();
  date.className = 'date';
  head.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  rating.className = 'rating';
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.className = 'comments';
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

submitReviewForm = (event) => {
  let error = false;
  const unixtimestamp = Date.now();
  const restaurantReview = {
    "restaurant_id": self.restaurant.id,
    "createdAt": unixtimestamp,
    "updatedAt": unixtimestamp,
    "id": this.reviews.slice(-1)[0].id + 1
  };

  const form = document.getElementById("review-form");
  data = new FormData(form)

  for (let [key, value] of data.entries()) {
    if (value === undefined || value == "") {
      console.log('Missing required fields. Exiting.');
      error = true;
      break;
    }
    restaurantReview[key] = value;
  };
  if (!error) {
    appendReview(restaurantReview);
    let rev;
    if (!navigator.onLine) {
      rev = [restaurantReview];
      if (this.reviewsToBeSynced != undefined) {
        rev = [restaurantReview, ...this.reviewsToBeSynced];
      }
      DBHelper.writeReviewsToBeSynced(rev);
    } else {
      rev =[restaurantReview, ...this.reviews] 
      DBHelper.writeReviewstoCache(rev);
    }
    this.reviews = rev;
    form.reset();
  }
}

const appendReview = (review) => {
  const ul = document.getElementById('reviews-list');
  ul.appendChild(createReviewHTML(review));
}

window.addEventListener('online', (event) => {
  DBHelper.getReviewsToBeSynced().then(reviews => {
    console.log('You are back online!')
    console.log('Starting to sync all reviews that we kept in cache.')
    DBHelper.writeReviewstoCache(this.reviews).then(() => {
      DBHelper.clearReviewsToBeSynced();
    });
  });
});

const submitButtom = document.getElementById("review-submit-button");
submitButtom.addEventListener('click', (event) => {
  event.preventDefault();
  submitReviewForm(event);
});