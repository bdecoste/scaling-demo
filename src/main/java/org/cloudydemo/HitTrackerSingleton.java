package org.cloudydemo;

import java.net.UnknownHostException;

import javax.ejb.Singleton;

import com.mongodb.BasicDBObject;
import com.mongodb.DB;
import com.mongodb.DBCollection;
import com.mongodb.DBCursor;
import com.mongodb.Mongo;

@Singleton
public class HitTrackerSingleton implements HitTracker {
	private Mongo mongo;
	private DB mongoDB;

	// Cached number of hits
	private int hits;

	// The gear id of the instance this singleton is running on
	private String gearId;

	// Cache start time in milliseconds
	private long cacheStartTime;

	// Persist the cache every second
	private final long CACHE_TIME = 1000;

	private final String COLLECTION = "hitTracker";

	public HitTrackerSingleton() {
		String host = System.getenv("OPENSHIFT_MONGODB_DB_HOST");
		String user = System.getenv("OPENSHIFT_MONGODB_DB_USERNAME");
		String password = System.getenv("OPENSHIFT_MONGODB_DB_PASSWORD");
		int port = Integer.decode(System.getenv("OPENSHIFT_MONGODB_DB_PORT"));
		gearId = System.getenv("OPENSHIFT_GEAR_UUID");

		try {
			mongo = new Mongo(host, port);
		} catch (UnknownHostException e) {
			e.printStackTrace();
		}
		mongoDB = mongo.getDB(System.getenv("OPENSHIFT_APP_NAME"));
		if (mongoDB.authenticate(user, password.toCharArray()) == false) {
			System.err.println("ERROR - Authentication Failed");
		}

		// Start the caching clock
		cacheStartTime = System.currentTimeMillis();
	}

	@Override
	public int displayHitsSince(long time) {
		int hits = 0;
		
		try {
			mongoDB.requestStart();
			DBCollection coll = mongoDB.getCollection(COLLECTION);
			BasicDBObject query = new BasicDBObject();
			query.put("time", "{$gt: " + System.currentTimeMillis() + "}");
			query.put("gear", gearId);
			DBCursor cur = coll.find(query);
			hits = cur.count();
		} finally {
			mongoDB.requestDone();
		}
		
		return hits;
	}

	private void persist() {
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

	@Override
	public void addHit() {
		hits++;

		// See if we need to persist
		if (System.currentTimeMillis() - cacheStartTime > CACHE_TIME) {
			persist();
		}
	}
}
