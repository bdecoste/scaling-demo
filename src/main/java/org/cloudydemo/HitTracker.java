package org.cloudydemo;

import java.util.Date;
import java.util.List;
import java.util.logging.Logger;

import javax.annotation.PostConstruct;
import javax.ejb.Schedule;
import javax.ejb.Singleton;
import javax.ejb.Startup;
import javax.ejb.Timeout;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.CriteriaQuery;
import javax.persistence.criteria.Root;

import org.cloudydemo.model.Application;
import org.cloudydemo.model.Gear;
import org.cloudydemo.model.Hit;
import org.cloudydemo.model.HitEntry;

@Startup
@Singleton
public class HitTracker {
	@PersistenceContext
	private EntityManager em;

	private static final Logger LOGGER = Logger.getLogger(HitTracker.class
			.getName());

	// Cached number of hits
	private int hits;

	// The gear id of the instance this singleton is running on
	private String gearId;

	// The application name
	private String appName;

	@PostConstruct
	void initialize() {
		gearId = System.getenv("OPENSHIFT_GEAR_UUID");
		appName = System.getenv("OPENSHIFT_APP_NAME");
	}

	public Application displayHitsSince(long time) {
		LOGGER.fine("Displaying hits");

		Application app = new Application(appName);

		CriteriaBuilder builder = em.getCriteriaBuilder();
		CriteriaQuery<HitEntry> criteria = builder.createQuery(HitEntry.class);
		Root<HitEntry> hitEntry = criteria.from(HitEntry.class);
		Date fromDate = new Date(time);
		criteria.where(builder.greaterThan(hitEntry.<Date> get("time"),
				fromDate));
		List<HitEntry> results = em.createQuery(criteria).getResultList();

		for (HitEntry result : results) {
			String gearId = result.getGearId();

			// Get or create the gear for the application
			Gear gear = new Gear(gearId);
			if (!app.getChildren().contains(gear)) {
				app.getChildren().add(gear);
			} else {
				int index = app.getChildren().indexOf(gear);
				gear = app.getChildren().get(index);
			}

			String id = result.getId().toString();
			Date timestamp = result.getTime();
			int hits = result.getHits();

			// Add the hits and timestamp to the gear
			gear.getChildren().add(new Hit(id, timestamp, hits));
		}

		LOGGER.fine("Application = " + app);

		return app;
	}

	/*
	 * Persist using the Timer service every second
	 */
	@Schedule(hour = "*", minute = "*", second = "*/2", persistent = false)
	public void persist() {
		if (hits > 0) {
			LOGGER.fine("Persisting " + hits + " to Mongo for gear " + gearId);

			HitEntry hitEntry = new HitEntry();
			hitEntry.setGearId(gearId);
			hitEntry.setHits(hits);
			hitEntry.setTime(new Date());
			
			em.persist(hitEntry);
		}
		
		hits = 0;
	}

	@Timeout
	public void timed() {
		// Just created to handle timeouts on the schedule calls
		// which can be ignored.
	}

	public void addHit() {
		hits++;
	}
}
