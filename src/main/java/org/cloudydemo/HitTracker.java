package org.cloudydemo;

import java.net.UnknownHostException;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;

import javax.annotation.PostConstruct;
import javax.ejb.Singleton;
import javax.ejb.Startup;

import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBCollection;
import com.mongodb.DBCursor;
import com.mongodb.DBObject;
import com.mongodb.Mongo;

@Startup
@Singleton
public class HitTracker {
	private Mongo mongo;
	private DB mongoDB;

	private static final Logger LOGGER = Logger.getLogger(HitTracker.class
			.getName());

	// Cached number of hits
	private int hits;

	// The gear id of the instance this singleton is running on
	private String gearId;

	// Cache start time in milliseconds
	private long cacheStartTime;

	// Persist the cache every second
	private final long CACHE_TIME = 500;

	private final String COLLECTION = "hitTracker";

	@PostConstruct
	void initialize() {
		String host = System.getenv("OPENSHIFT_MONGODB_DB_HOST");
		String user = System.getenv("OPENSHIFT_MONGODB_DB_USERNAME");
		String password = System.getenv("OPENSHIFT_MONGODB_DB_PASSWORD");
		int port = Integer.decode(System.getenv("OPENSHIFT_MONGODB_DB_PORT"));
		gearId = System.getenv("OPENSHIFT_GEAR_UUID");

		LOGGER.fine("Connecting with host = " + host + " / port = " + port);

		try {
			mongo = new Mongo(host, port);
		} catch (UnknownHostException e) {
			e.printStackTrace();
		}
		mongoDB = mongo.getDB(System.getenv("OPENSHIFT_APP_NAME"));
		if (user != null && password != null) {
			if (mongoDB.authenticate(user, password.toCharArray()) == false) {
				throw new RuntimeException("Mongo authentication failed");
			}
		} else {
			LOGGER.warning("No username / password given so not authenticating with Mongo");
		}

		// Start the caching clock
		cacheStartTime = System.currentTimeMillis();
	}

	public Map<String, Integer> displayHitsSince(long time) {
		LOGGER.fine("Displaying hits");

		Map<String, Integer> results = new HashMap<String, Integer>();

		try {
			mongoDB.requestStart();
			DBCollection coll = mongoDB.getCollection(COLLECTION);

			BasicDBObject query = new BasicDBObject("time", new BasicDBObject(
					"$gt", time));
			DBCursor cur = coll.find(query);

			try {
				while (cur.hasNext()) {
					DBObject result = cur.next();
					String gear = (String) result.get("gear");
					Integer hits = (Integer) result.get("hits");

					// Update the results
					if (results.containsKey(gear)) {
						// Add the hits to the existing value
						results.put(gear, new Integer(results.get(gear)
								.intValue() + hits.intValue()));
					} else {
						results.put(gear, hits);
					}
				}
			} finally {
				cur.close();
			}
		} finally {
			mongoDB.requestDone();
		}

		LOGGER.fine("Results = " + results);

		return results;
	}

	public void persist() {
		LOGGER.fine("Persisting " + hits + " to Mongo for gear " + gearId);

		try {
			mongoDB.requestStart();

			DBCollection coll = mongoDB.getCollection(COLLECTION);

			BasicDBObject doc = new BasicDBObject();
			doc.put("gear", gearId);
			doc.put("hits", hits);
			doc.put("time", System.currentTimeMillis());

			coll.insert(doc);
		} finally {
			mongoDB.requestDone();
		}

		// Reset the hit counter and the timer
		hits = 0;
		cacheStartTime = System.currentTimeMillis();
	}

	public void addHit() {
		hits++;

		// See if we need to persist
		long currentTime = System.currentTimeMillis();
		LOGGER.fine("Current Time = " + currentTime);
		LOGGER.fine("Cache Start Time = " + cacheStartTime);
		LOGGER.fine("Difference = " + (currentTime - cacheStartTime));
		if (currentTime - cacheStartTime > CACHE_TIME) {
			persist();
		}
	}
}