package org.cloudydemo;

import javax.ejb.EJB;
import javax.ejb.Stateless;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

@Path("/add")
@Stateless
public class AddHits {
	@EJB
	private HitTracker hitTracker;

	@GET
	@POST
	@Produces(MediaType.TEXT_PLAIN)
	public String addHit() {
		hitTracker.addHit();
		return "Success";
	}
}