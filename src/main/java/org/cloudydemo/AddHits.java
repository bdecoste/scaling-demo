package org.cloudydemo;

import javax.inject.Inject;
import javax.inject.Named;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;

@Path("/add")
public class AddHits {
	@Inject
	@Named("hitTracker")
	private HitTracker hitTracker;

	@GET
	@POST
	void addHit() {
		hitTracker.addHit();
	}
}