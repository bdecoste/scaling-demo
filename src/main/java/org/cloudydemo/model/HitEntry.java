package org.cloudydemo.model;

import java.util.Date;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.validation.constraints.NotNull;

@Entity
@Table
public class HitEntry {
	@Id
	@GeneratedValue
	Long id;
	
	@NotNull
	String gearId;
	
	int hits;
	
	@NotNull
	Date time;
	
	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getGearId() {
		return gearId;
	}

	public void setGearId(String gearId) {
		this.gearId = gearId;
	}

	public int getHits() {
		return hits;
	}

	public void setHits(int hits) {
		this.hits = hits;
	}

	public Date getTime() {
		return time;
	}

	public void setTime(Date time) {
		this.time = time;
	} 
}
