package org.cloudydemo;

import javax.inject.Inject;
import javax.inject.Named;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

@Path("/display")
public class DisplayHits {
	@Inject
	@Named("hitTracker")
	private HitTracker hitTracker;
	
	long lastCheckTime = System.currentTimeMillis();

	@GET
	@Produces(MediaType.TEXT_PLAIN)
	int getHits() {
		int hits = hitTracker.displayHitsSince(lastCheckTime);
		lastCheckTime = System.currentTimeMillis();
		return hits;
	}
}